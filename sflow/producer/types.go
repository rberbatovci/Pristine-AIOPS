package main

import "time"

// SFlowDatagram represents the common sFlow datagram header.
type SFlowDatagram struct {
	Version        uint32
	AgentIP        string
	SubAgent       uint32
	SequenceNumber uint32
	Uptime         uint32

	Samples []SFlowSample
}

// SFlowSample represents one sample inside the datagram.
type SFlowSample struct {
	Type uint32

	Flow         *SFlowFlowSample
	Counter      *SFlowCounterSample
	ExpandedFlow *SFlowFlowSample
}

// SFlowFlowSample represents both standard and expanded flow samples.
type SFlowFlowSample struct {
	SequenceNumber uint32

	SourceIDType  uint32
	SourceIDIndex uint32

	SamplingRate uint32
	SamplePool   uint32
	Drops        uint32

	InputInterface  uint32
	OutputInterface uint32

	Records []SFlowRecord
}

// SFlowCounterSample represents a counter sample.
type SFlowCounterSample struct {
	SequenceNumber uint32

	SourceIDType  uint32
	SourceIDIndex uint32

	Records []SFlowCounterRecord
}

// SFlowRecord represents a flow record.
type SFlowRecord struct {
	Enterprise uint32
	Format     uint32
	Length     uint32

	RawPacket *SFlowRawPacket

	RawData []byte
}

// SFlowCounterRecord represents a counter record.
type SFlowCounterRecord struct {
	Enterprise uint32
	Format     uint32
	Length     uint32

	Data []byte
}

// SFlowRawPacket is the standard sFlow raw packet record.
type SFlowRawPacket struct {
	Protocol     uint32
	FrameLength  uint32
	Stripped     uint32
	HeaderLength uint32

	Header []byte
}

// SFlowFlowRecord is the normalized flow representation
// that we can later publish to Kafka/OpenSearch.
type SFlowFlowRecord struct {
	Source string `json:"source"`

	AgentIP string `json:"agent_ip"`
	Device  string `json:"device"`

	SourceIP      string `json:"source_ip"`
	DestinationIP string `json:"destination_ip"`

	SourcePort      uint16 `json:"source_port"`
	DestinationPort uint16 `json:"destination_port"`

	Protocol uint8 `json:"protocol"`

	InputInterface  uint32 `json:"input_interface"`
	OutputInterface uint32 `json:"output_interface"`

	Bytes   uint64 `json:"bytes"`
	Packets uint64 `json:"packets"`

	SamplingRate uint32 `json:"sampling_rate"`

	AgentUptime uint32 `json:"agent_uptime"`

	Timestamp time.Time `json:"timestamp"`
}
