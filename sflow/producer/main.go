package main

import (
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"os"
	"time"
)

const (
	defaultListenAddress = ":1165"
	bufferSize           = 65535
)

func main() {

	listenAddress := os.Getenv("SFLOW_LISTEN_ADDRESS")

	if listenAddress == "" {
		listenAddress = defaultListenAddress
	}

	addr, err := net.ResolveUDPAddr(
		"udp",
		listenAddress,
	)

	if err != nil {
		log.Fatalf(
			"failed to resolve UDP address: %v",
			err,
		)
	}

	conn, err := net.ListenUDP(
		"udp",
		addr,
	)

	if err != nil {
		log.Fatalf(
			"failed to listen on %s: %v",
			listenAddress,
			err,
		)
	}

	defer conn.Close()

	log.Printf(
		"Pristine-AIOPS sFlow producer started",
	)

	log.Printf(
		"Listening on UDP %s",
		listenAddress,
	)

	buffer := make([]byte, bufferSize)

	for {

		n, remoteAddr, err :=
			conn.ReadFromUDP(buffer)

		if err != nil {
			log.Printf(
				"UDP read error: %v",
				err,
			)

			continue
		}

		receiveTime := time.Now().UTC()

		packet := buffer[:n]

		log.Printf(
			"sFlow datagram received: source=%s bytes=%d time=%s",
			remoteAddr.String(),
			n,
			receiveTime.Format(time.RFC3339),
		)

		// Keep this while developing the decoder.
		dumpSize := n

		if dumpSize > 64 {
			dumpSize = 64
		}

		log.Printf(
			"packet[0:%d]=%s",
			dumpSize,
			hex.EncodeToString(
				packet[:dumpSize],
			),
		)

		datagram, flowRecords, err :=
			decodeSFlowDatagram(
				packet,
				receiveTime,
			)

		if err != nil {
			log.Printf(
				"sFlow decode error: %v",
				err,
			)

			continue
		}

		log.Printf(
			"sFlow decoded: agent=%s version=%d sub-agent=%d sequence=%d uptime=%d samples=%d flow-records=%d",
			datagram.AgentIP,
			datagram.Version,
			datagram.SubAgent,
			datagram.SequenceNumber,
			datagram.Uptime,
			len(datagram.Samples),
			len(flowRecords),
		)

		for _, sample := range datagram.Samples {

			switch sample.Type {

			case sampleTypeFlow:
				if sample.Flow != nil {
					log.Printf(
						"FLOW sample: seq=%d sampling-rate=%d pool=%d drops=%d input=%d output=%d records=%d",
						sample.Flow.SequenceNumber,
						sample.Flow.SamplingRate,
						sample.Flow.SamplePool,
						sample.Flow.Drops,
						sample.Flow.InputInterface,
						sample.Flow.OutputInterface,
						len(sample.Flow.Records),
					)
				}

			case sampleTypeExpandedFlow:
				if sample.ExpandedFlow != nil {
					log.Printf(
						"EXPANDED FLOW sample: seq=%d sampling-rate=%d pool=%d drops=%d input=%d output=%d records=%d",
						sample.ExpandedFlow.SequenceNumber,
						sample.ExpandedFlow.SamplingRate,
						sample.ExpandedFlow.SamplePool,
						sample.ExpandedFlow.Drops,
						sample.ExpandedFlow.InputInterface,
						sample.ExpandedFlow.OutputInterface,
						len(sample.ExpandedFlow.Records),
					)
				}

			case sampleTypeCounter:
				if sample.Counter != nil {
					log.Printf(
						"COUNTER sample: seq=%d source-type=%d source-index=%d records=%d",
						sample.Counter.SequenceNumber,
						sample.Counter.SourceIDType,
						sample.Counter.SourceIDIndex,
						len(sample.Counter.Records),
					)
				}

			case sampleTypeExpandedCounter:
				if sample.Counter != nil {
					log.Printf(
						"EXPANDED COUNTER sample: seq=%d source-type=%d source-index=%d records=%d",
						sample.Counter.SequenceNumber,
						sample.Counter.SourceIDType,
						sample.Counter.SourceIDIndex,
						len(sample.Counter.Records),
					)
				}
			}
		}

		// These are the records that can eventually go to Kafka.
		for _, flow := range flowRecords {

			fmt.Printf(
				"FLOW agent=%s src=%s:%d dst=%s:%d protocol=%d bytes=%d packets=%d sampling=%d input=%d output=%d\n",
				flow.AgentIP,
				flow.SourceIP,
				flow.SourcePort,
				flow.DestinationIP,
				flow.DestinationPort,
				flow.Protocol,
				flow.Bytes,
				flow.Packets,
				flow.SamplingRate,
				flow.InputInterface,
				flow.OutputInterface,
			)
		}
	}
}
