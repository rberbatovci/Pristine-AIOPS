package main

import (
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"log"
	"net"
	"time"
)

const (
	sFlowVersion5 = 5

	// sFlow sample types.
	sampleTypeFlow            = 1
	sampleTypeCounter         = 2
	sampleTypeExpandedFlow    = 3
	sampleTypeExpandedCounter = 4

	// sFlow flow record formats.
	flowRecordRawPacket = 1

	// sFlow counter record formats.
	counterRecordGenericInterface = 1
	counterRecordProcessor        = 1001
)

// sFlowReader provides safe big-endian reads.
type sFlowReader struct {
	data []byte
	pos  int
}

func newSFlowReader(data []byte) *sFlowReader {
	return &sFlowReader{
		data: data,
		pos:  0,
	}
}

func (r *sFlowReader) remaining() int {
	return len(r.data) - r.pos
}

func (r *sFlowReader) readUint32() (uint32, error) {
	if r.remaining() < 4 {
		return 0, fmt.Errorf(
			"unexpected end of packet at offset %d",
			r.pos,
		)
	}

	value := binary.BigEndian.Uint32(
		r.data[r.pos : r.pos+4],
	)

	r.pos += 4

	return value, nil
}

func (r *sFlowReader) readBytes(length int) ([]byte, error) {
	if length < 0 {
		return nil, fmt.Errorf("negative length: %d", length)
	}

	if r.remaining() < length {
		return nil, fmt.Errorf(
			"packet too short: need %d bytes, have %d",
			length,
			r.remaining(),
		)
	}

	value := r.data[r.pos : r.pos+length]

	r.pos += length

	return value, nil
}

func (r *sFlowReader) skip(length int) error {
	_, err := r.readBytes(length)
	return err
}

func (r *sFlowReader) readIPv4() (string, error) {
	data, err := r.readBytes(4)
	if err != nil {
		return "", err
	}

	return net.IP(data).String(), nil
}

// decodeSFlowDatagram parses the complete sFlow datagram.
func decodeSFlowDatagram(
	data []byte,
	receivedAt time.Time,
) (*SFlowDatagram, []SFlowFlowRecord, error) {

	r := newSFlowReader(data)

	// ---------------------------------------------------------
	// sFlow datagram header
	// ---------------------------------------------------------

	version, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	if version != sFlowVersion5 {
		return nil, nil, fmt.Errorf(
			"unsupported sFlow version: %d",
			version,
		)
	}

	addressType, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	if addressType != 1 {
		return nil, nil, fmt.Errorf(
			"unsupported agent address type: %d",
			addressType,
		)
	}

	agentIP, err := r.readIPv4()
	if err != nil {
		return nil, nil, err
	}

	subAgent, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	sequenceNumber, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	uptime, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	sampleCount, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	datagram := &SFlowDatagram{
		Version:        version,
		AgentIP:        agentIP,
		SubAgent:       subAgent,
		SequenceNumber: sequenceNumber,
		Uptime:         uptime,
		Samples:        make([]SFlowSample, 0, sampleCount),
	}

	var flowRecords []SFlowFlowRecord

	// ---------------------------------------------------------
	// Samples
	// ---------------------------------------------------------

	for i := uint32(0); i < sampleCount; i++ {
		if r.remaining() < 8 {
			return nil, nil, fmt.Errorf(
				"packet ended before sample %d",
				i,
			)
		}

		sampleType, err := r.readUint32()
		if err != nil {
			return nil, nil, err
		}

		sampleLength, err := r.readUint32()
		if err != nil {
			return nil, nil, err
		}

		sampleData, err := r.readBytes(int(sampleLength))
		if err != nil {
			return nil, nil, err
		}

		sample := SFlowSample{
			Type: sampleType,
		}

		switch sampleType {

		case sampleTypeFlow:
			flowSample, records, err :=
				decodeFlowSample(
					sampleData,
					agentIP,
					uptime,
					receivedAt,
				)

			if err != nil {
				return nil, nil, fmt.Errorf(
					"flow sample: %w",
					err,
				)
			}

			sample.Flow = flowSample
			flowRecords = append(flowRecords, records...)

		case sampleTypeExpandedFlow:
			flowSample, records, err :=
				decodeExpandedFlowSample(
					sampleData,
					agentIP,
					uptime,
					receivedAt,
				)

			if err != nil {
				return nil, nil, fmt.Errorf(
					"expanded flow sample: %w",
					err,
				)
			}

			sample.ExpandedFlow = flowSample
			flowRecords = append(flowRecords, records...)

		case sampleTypeCounter:
			counterSample, err :=
				decodeCounterSample(sampleData)

			if err != nil {
				return nil, nil, fmt.Errorf(
					"counter sample: %w",
					err,
				)
			}

			sample.Counter = counterSample

		case sampleTypeExpandedCounter:
			counterSample, err :=
				decodeExpandedCounterSample(sampleData)

			if err != nil {
				return nil, nil, fmt.Errorf(
					"expanded counter sample: %w",
					err,
				)
			}

			sample.Counter = counterSample

		default:
			log.Printf(
				"unknown sFlow sample type=%d length=%d",
				sampleType,
				sampleLength,
			)
		}

		datagram.Samples = append(
			datagram.Samples,
			sample,
		)
	}

	return datagram, flowRecords, nil
}

// decodeFlowSample parses standard flow samples.
func decodeFlowSample(
	data []byte,
	agentIP string,
	uptime uint32,
	receivedAt time.Time,
) (*SFlowFlowSample, []SFlowFlowRecord, error) {

	r := newSFlowReader(data)

	sequenceNumber, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	sourceID, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	samplingRate, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	samplePool, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	drops, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	inputInterface, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	outputInterface, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	recordCount, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	flowSample := &SFlowFlowSample{
		SequenceNumber:  sequenceNumber,
		SourceIDType:    sourceID >> 24,
		SourceIDIndex:   sourceID & 0x00ffffff,
		SamplingRate:    samplingRate,
		SamplePool:      samplePool,
		Drops:           drops,
		InputInterface:  inputInterface,
		OutputInterface: outputInterface,
		Records:         make([]SFlowRecord, 0, recordCount),
	}

	var normalized []SFlowFlowRecord

	for i := uint32(0); i < recordCount; i++ {
		record, normalizedRecord, err :=
			decodeFlowRecord(
				r,
				agentIP,
				uptime,
				samplingRate,
				inputInterface,
				outputInterface,
				receivedAt,
			)

		if err != nil {
			return nil, nil, fmt.Errorf(
				"flow record %d: %w",
				i,
				err,
			)
		}

		flowSample.Records = append(
			flowSample.Records,
			*record,
		)

		if normalizedRecord != nil {
			normalized = append(
				normalized,
				*normalizedRecord,
			)
		}
	}

	return flowSample, normalized, nil
}

// decodeExpandedFlowSample parses expanded flow samples.
func decodeExpandedFlowSample(
	data []byte,
	agentIP string,
	uptime uint32,
	receivedAt time.Time,
) (*SFlowFlowSample, []SFlowFlowRecord, error) {

	r := newSFlowReader(data)

	sequenceNumber, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	sourceIDType, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	sourceIDIndex, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	samplingRate, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	samplePool, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	drops, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	inputInterface, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	outputInterface, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	recordCount, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	flowSample := &SFlowFlowSample{
		SequenceNumber:  sequenceNumber,
		SourceIDType:    sourceIDType,
		SourceIDIndex:   sourceIDIndex,
		SamplingRate:    samplingRate,
		SamplePool:      samplePool,
		Drops:           drops,
		InputInterface:  inputInterface,
		OutputInterface: outputInterface,
		Records:         make([]SFlowRecord, 0, recordCount),
	}

	var normalized []SFlowFlowRecord

	for i := uint32(0); i < recordCount; i++ {
		record, normalizedRecord, err :=
			decodeFlowRecord(
				r,
				agentIP,
				uptime,
				samplingRate,
				inputInterface,
				outputInterface,
				receivedAt,
			)

		if err != nil {
			return nil, nil, fmt.Errorf(
				"expanded flow record %d: %w",
				i,
				err,
			)
		}

		flowSample.Records = append(
			flowSample.Records,
			*record,
		)

		if normalizedRecord != nil {
			normalized = append(
				normalized,
				*normalizedRecord,
			)
		}
	}

	return flowSample, normalized, nil
}

func decodeFlowRecord(
	r *sFlowReader,
	agentIP string,
	uptime uint32,
	samplingRate uint32,
	inputInterface uint32,
	outputInterface uint32,
	receivedAt time.Time,
) (*SFlowRecord, *SFlowFlowRecord, error) {

	// sFlow flow record header:
	//
	// bits 31..12 = enterprise
	// bits 11..0  = format
	//
	// followed by:
	//
	// record length
	// record data

	enterpriseFormat, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	length, err := r.readUint32()
	if err != nil {
		return nil, nil, err
	}

	enterprise := enterpriseFormat >> 12
	format := enterpriseFormat & 0x0fff

	recordData, err := r.readBytes(int(length))
	if err != nil {
		return nil, nil, err
	}

	record := &SFlowRecord{
		Enterprise: enterprise,
		Format:     format,
		Length:     length,
		RawData:    recordData,
	}

	// Only decode the standard raw packet record.
	if enterprise != 0 || format != flowRecordRawPacket {
		return record, nil, nil
	}

	rawPacket, err := decodeRawPacket(recordData)
	if err != nil {
		return nil, nil, err
	}

	record.RawPacket = rawPacket

	normalized := parseNetworkPacket(
		rawPacket,
		agentIP,
		uptime,
		samplingRate,
		inputInterface,
		outputInterface,
		receivedAt,
	)

	return record, normalized, nil
}

// decodeRawPacket parses sFlow raw packet record format 1.
func decodeRawPacket(data []byte) (*SFlowRawPacket, error) {
	r := newSFlowReader(data)

	protocol, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	frameLength, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	stripped, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	headerLength, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	header, err := r.readBytes(int(headerLength))
	if err != nil {
		return nil, err
	}

	return &SFlowRawPacket{
		Protocol:     protocol,
		FrameLength:  frameLength,
		Stripped:     stripped,
		HeaderLength: headerLength,
		Header:       header,
	}, nil
}

// parseNetworkPacket extracts Ethernet/IP/TCP/UDP information.
func parseNetworkPacket(
	packet *SFlowRawPacket,
	agentIP string,
	uptime uint32,
	samplingRate uint32,
	inputInterface uint32,
	outputInterface uint32,
	receivedAt time.Time,
) *SFlowFlowRecord {

	header := packet.Header

	if len(header) < 14 {
		return nil
	}

	etherType := binary.BigEndian.Uint16(
		header[12:14],
	)

	offset := 14

	// Handle one or more VLAN tags.
	for etherType == 0x8100 ||
		etherType == 0x88a8 ||
		etherType == 0x9100 {

		if len(header) < offset+4 {
			return nil
		}

		etherType = binary.BigEndian.Uint16(
			header[offset+2 : offset+4],
		)

		offset += 4
	}

	record := &SFlowFlowRecord{
		Source:          "sflow",
		AgentIP:         agentIP,
		Device:          agentIP,
		InputInterface:  inputInterface,
		OutputInterface: outputInterface,
		Bytes:           uint64(packet.FrameLength),
		Packets:         1,
		SamplingRate:    samplingRate,
		AgentUptime:     uptime,
		Timestamp:       receivedAt,
	}

	// ---------------------------------------------------------
	// IPv4
	// ---------------------------------------------------------

	if etherType == 0x0800 {

		if len(header) < offset+20 {
			return nil
		}

		versionIHL := header[offset]

		version := versionIHL >> 4
		ihl := versionIHL & 0x0f

		if version != 4 {
			return nil
		}

		ipHeaderLength := int(ihl) * 4

		if len(header) < offset+ipHeaderLength {
			return nil
		}

		record.Protocol = header[offset+9]

		record.SourceIP = net.IP(
			header[offset+12 : offset+16],
		).String()

		record.DestinationIP = net.IP(
			header[offset+16 : offset+20],
		).String()

		transportOffset := offset + ipHeaderLength

		parseTransportPorts(
			header,
			transportOffset,
			record.Protocol,
			record,
		)

		return record
	}

	// ---------------------------------------------------------
	// IPv6
	// ---------------------------------------------------------

	if etherType == 0x86dd {

		if len(header) < offset+40 {
			return nil
		}

		version := header[offset] >> 4

		if version != 6 {
			return nil
		}

		record.Protocol = header[offset+6]

		record.SourceIP = net.IP(
			header[offset+8 : offset+24],
		).String()

		record.DestinationIP = net.IP(
			header[offset+24 : offset+40],
		).String()

		transportOffset := offset + 40

		parseTransportPorts(
			header,
			transportOffset,
			record.Protocol,
			record,
		)

		return record
	}

	return record
}

// parseTransportPorts extracts TCP/UDP ports.
func parseTransportPorts(
	header []byte,
	offset int,
	protocol uint8,
	record *SFlowFlowRecord,
) {

	if protocol != 6 && protocol != 17 {
		return
	}

	if len(header) < offset+4 {
		return
	}

	record.SourcePort =
		binary.BigEndian.Uint16(
			header[offset : offset+2],
		)

	record.DestinationPort =
		binary.BigEndian.Uint16(
			header[offset+2 : offset+4],
		)
}

// decodeCounterSample parses standard counter samples.
func decodeCounterSample(
	data []byte,
) (*SFlowCounterSample, error) {

	r := newSFlowReader(data)

	sequence, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	sourceID, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	recordCount, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	sample := &SFlowCounterSample{
		SequenceNumber: sequence,
		SourceIDType:   sourceID >> 24,
		SourceIDIndex:  sourceID & 0x00ffffff,
		Records:        make([]SFlowCounterRecord, 0, recordCount),
	}

	for i := uint32(0); i < recordCount; i++ {

		record, err := decodeCounterRecord(r)
		if err != nil {
			return nil, fmt.Errorf(
				"counter record %d: %w",
				i,
				err,
			)
		}

		sample.Records = append(
			sample.Records,
			*record,
		)
	}

	return sample, nil
}

// decodeExpandedCounterSample parses expanded counter samples.
func decodeExpandedCounterSample(
	data []byte,
) (*SFlowCounterSample, error) {

	r := newSFlowReader(data)

	sequence, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	sourceIDType, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	sourceIDIndex, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	recordCount, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	sample := &SFlowCounterSample{
		SequenceNumber: sequence,
		SourceIDType:   sourceIDType,
		SourceIDIndex:  sourceIDIndex,
		Records:        make([]SFlowCounterRecord, 0, recordCount),
	}

	for i := uint32(0); i < recordCount; i++ {

		record, err := decodeCounterRecord(r)
		if err != nil {
			return nil, fmt.Errorf(
				"expanded counter record %d: %w",
				i,
				err,
			)
		}

		sample.Records = append(
			sample.Records,
			*record,
		)

		if record.Format == counterRecordProcessor {
			log.Printf(
				"sFlow processor counter: enterprise=%d format=%d length=%d data=%s",
				record.Enterprise,
				record.Format,
				record.Length,
				hex.EncodeToString(record.Data),
			)
		}
	}

	return sample, nil
}

func decodeCounterRecord(
	r *sFlowReader,
) (*SFlowCounterRecord, error) {

	// sFlow encodes enterprise and format into
	// a single 32-bit value:
	//
	// bits 31..12 = enterprise
	// bits 11..0  = format

	enterpriseFormat, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	length, err := r.readUint32()
	if err != nil {
		return nil, err
	}

	enterprise := enterpriseFormat >> 12
	format := enterpriseFormat & 0x0fff

	data, err := r.readBytes(int(length))
	if err != nil {
		return nil, err
	}

	return &SFlowCounterRecord{
		Enterprise: enterprise,
		Format:     format,
		Length:     length,
		Data:       data,
	}, nil
}
