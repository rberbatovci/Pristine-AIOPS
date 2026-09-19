package main

import (
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"strings"
	"time"

	"google.golang.org/grpc"
	"google.golang.org/protobuf/proto"

	"nexus-telemetry/mdt_dialout"
	"nexus-telemetry/telemetry"
)

const listenAddress = ":1164"

// MDTServer implements the Cisco Nexus gRPC MDT dial-out service.
type MDTServer struct {
	mdt_dialout.UnimplementedGRPCMdtDialoutServer
}

// ------------------------------------------------------------
// Utility functions
// ------------------------------------------------------------

func dumpBytes(label string, data []byte, max int) {
	if len(data) == 0 {
		log.Printf("%s: <empty>", label)
		return
	}

	if len(data) > max {
		data = data[:max]
	}

	log.Printf("%s (%d bytes): %s", label, len(data), hex.EncodeToString(data))
}

func unixMilliToTime(ts uint64) time.Time {
	if ts == 0 {
		return time.Time{}
	}

	return time.UnixMilli(int64(ts))
}

func printTimestamp(label string, ts uint64) {
	if ts == 0 {
		log.Printf("%-22s: 0", label)
		return
	}

	log.Printf(
		"%-22s: %d (%s)",
		label,
		ts,
		unixMilliToTime(ts).UTC().Format(time.RFC3339Nano),
	)
}

// ------------------------------------------------------------
// Parse System / Show Version
// ------------------------------------------------------------

func parseSystem(telemetryMsg *telemetry.Telemetry) {
	log.Println()
	log.Println("============================================================")
	log.Println("SYSTEM TELEMETRY")
	log.Println("============================================================")

	log.Printf("Node ID       : %q", telemetryMsg.GetNodeIdStr())
	log.Printf("Encoding Path : %q", telemetryMsg.GetEncodingPath())

	printTimestamp(
		"Message timestamp",
		telemetryMsg.GetMsgTimestamp(),
	)

	log.Printf(
		"Collection ID : %d",
		telemetryMsg.GetCollectionId(),
	)

	/*
		At this point the outer telemetry envelope is decoded.

		For your current Nexus message:

		    Encoding path = "show version"

		The actual payload is currently appearing as GPBKV.

		We therefore print the protobuf representation so we can
		identify the exact inner schema used by this NX-OS version.
	*/

	gpbkv := telemetryMsg.GetDataGpbkv()

	log.Printf("GPBKV records : %d", len(gpbkv))

	for i, field := range gpbkv {

		if field == nil {
			log.Printf("GPBKV[%d]: NIL", i)
			continue
		}

		log.Println()
		log.Printf("---------------- SYSTEM GPBKV #%d ----------------", i)

		log.Printf("Name      : %q", field.GetName())
		log.Printf("Timestamp : %d", field.GetTimestamp())

		/*
			Do NOT assume a GetValue() field here until we inspect
			your generated telemetry.pb.go.

			For now print the complete protobuf object.

			This is extremely useful because protobuf generated
			structs expose the fields actually present in your
			version of the Cisco telemetry definition.
		*/

		log.Printf("GPBKV object: %+v", field)
	}
}

// ------------------------------------------------------------
// Parse Interface Telemetry
// ------------------------------------------------------------

func parseInterfaces(telemetryMsg *telemetry.Telemetry) {
	log.Println()
	log.Println("============================================================")
	log.Println("INTERFACE TELEMETRY")
	log.Println("============================================================")

	log.Printf("Node ID       : %q", telemetryMsg.GetNodeIdStr())
	log.Printf("Encoding Path : %q", telemetryMsg.GetEncodingPath())

	printTimestamp(
		"Message timestamp",
		telemetryMsg.GetMsgTimestamp(),
	)

	table := telemetryMsg.GetDataGpb()

	if table == nil {
		log.Println("No data_gpb table present")

		gpbkv := telemetryMsg.GetDataGpbkv()

		if len(gpbkv) > 0 {
			log.Printf(
				"Interface payload contains %d GPBKV records",
				len(gpbkv),
			)

			for i, field := range gpbkv {

				if field == nil {
					log.Printf("GPBKV[%d]: NIL", i)
					continue
				}

				log.Println()
				log.Printf("---------------- INTERFACE GPBKV #%d ----------------", i)

				log.Printf("Name      : %q", field.GetName())
				log.Printf("Timestamp : %d", field.GetTimestamp())
				log.Printf("Object    : %+v", field)
			}
		}

		return
	}

	rows := table.GetRow()

	log.Printf("GPB rows: %d", len(rows))

	for i, row := range rows {

		if row == nil {
			log.Printf("row[%d]: NIL", i)
			continue
		}

		log.Println()
		log.Printf("---------------- INTERFACE ROW #%d ----------------", i)

		printTimestamp(
			"Row timestamp",
			row.GetTimestamp(),
		)

		keys := row.GetKeys()
		content := row.GetContent()

		log.Printf("Keys size    : %d bytes", len(keys))
		log.Printf("Content size : %d bytes", len(content))

		if len(keys) > 0 {
			dumpBytes(
				"Keys",
				keys,
				256,
			)
		}

		if len(content) > 0 {
			dumpBytes(
				"Content",
				content,
				512,
			)
		}

		/*
			The next step is to unmarshal:

			    row.GetKeys()

			and:

			    row.GetContent()

			using the protobuf generated specifically for:

			    sys/intf/phys-[eth1/1]/phys

			We should not guess those protobuf types.
		*/
	}
}

// ------------------------------------------------------------
// Parse Telemetry
// ------------------------------------------------------------

func parseTelemetry(data []byte) {

	var telemetryMsg telemetry.Telemetry

	err := proto.Unmarshal(data, &telemetryMsg)

	if err != nil {
		log.Println("------------------------------------------------------------")
		log.Printf("TELEMETRY PROTOBUF DECODE FAILED")
		log.Printf("Error: %v", err)
		log.Println("------------------------------------------------------------")
		return
	}

	log.Println("Telemetry protobuf decoded successfully")

	// --------------------------------------------------------
	// Metadata
	// --------------------------------------------------------

	log.Println()
	log.Println("============================================================")
	log.Println("TELEMETRY METADATA")
	log.Println("============================================================")

	log.Printf(
		"Node ID          : %q",
		telemetryMsg.GetNodeIdStr(),
	)

	log.Printf(
		"Subscription ID  : %q",
		telemetryMsg.GetSubscriptionIdStr(),
	)

	log.Printf(
		"Encoding path    : %q",
		telemetryMsg.GetEncodingPath(),
	)

	log.Printf(
		"Collection ID    : %d",
		telemetryMsg.GetCollectionId(),
	)

	printTimestamp(
		"Collection start",
		telemetryMsg.GetCollectionStartTime(),
	)

	printTimestamp(
		"Message timestamp",
		telemetryMsg.GetMsgTimestamp(),
	)

	printTimestamp(
		"Collection end",
		telemetryMsg.GetCollectionEndTime(),
	)

	// --------------------------------------------------------
	// Select parser based on sensor path
	// --------------------------------------------------------

	path := strings.TrimSpace(
		telemetryMsg.GetEncodingPath(),
	)

	switch {

	case strings.EqualFold(path, "show version"):

		log.Println()
		log.Println("Detected SYSTEM / SHOW VERSION telemetry")

		parseSystem(&telemetryMsg)

	case strings.Contains(path, "sys/intf/phys"):

		log.Println()
		log.Println("Detected INTERFACE telemetry")

		parseInterfaces(&telemetryMsg)

	default:

		log.Println()
		log.Println("Unknown telemetry encoding path")
		log.Printf("Path: %q", path)

		// Still dump whatever payload exists.
		parseUnknown(&telemetryMsg)
	}
}

// ------------------------------------------------------------
// Unknown telemetry parser
// ------------------------------------------------------------

func parseUnknown(telemetryMsg *telemetry.Telemetry) {

	log.Println()
	log.Println("============================================================")
	log.Println("UNKNOWN TELEMETRY PAYLOAD")
	log.Println("============================================================")

	// --------------------------------------------------------
	// GPB
	// --------------------------------------------------------

	table := telemetryMsg.GetDataGpb()

	if table != nil {

		rows := table.GetRow()

		log.Printf(
			"data_gpb rows: %d",
			len(rows),
		)

		for i, row := range rows {

			if row == nil {
				continue
			}

			log.Printf(
				"row[%d]: timestamp=%d keys=%d content=%d",
				i,
				row.GetTimestamp(),
				len(row.GetKeys()),
				len(row.GetContent()),
			)

			dumpBytes(
				"keys",
				row.GetKeys(),
				256,
			)

			dumpBytes(
				"content",
				row.GetContent(),
				512,
			)
		}
	}

	// --------------------------------------------------------
	// GPBKV
	// --------------------------------------------------------

	gpbkv := telemetryMsg.GetDataGpbkv()

	if len(gpbkv) > 0 {

		log.Printf(
			"data_gpbkv records: %d",
			len(gpbkv),
		)

		for i, field := range gpbkv {

			if field == nil {
				continue
			}

			log.Printf(
				"GPBKV[%d]: name=%q timestamp=%d object=%+v",
				i,
				field.GetName(),
				field.GetTimestamp(),
				field,
			)
		}
	}
}

// ------------------------------------------------------------
// MDT gRPC stream
// ------------------------------------------------------------

func (s *MDTServer) MdtDialout(
	stream mdt_dialout.GRPCMdtDialout_MdtDialoutServer,
) error {

	startTime := time.Now()

	log.Println()
	log.Println("============================================================")
	log.Println("NEW CISCO NEXUS MDT gRPC STREAM")
	log.Println("============================================================")

	log.Printf(
		"Stream started: %s",
		startTime.Format(time.RFC3339Nano),
	)

	messageCount := 0

	for {

		msg, err := stream.Recv()

		// ----------------------------------------------------
		// Normal termination
		// ----------------------------------------------------

		if err == io.EOF {

			log.Println("------------------------------------------------------------")
			log.Println("Nexus closed the MDT gRPC stream normally")
			log.Printf(
				"Messages received: %d",
				messageCount,
			)
			log.Printf(
				"Stream duration: %s",
				time.Since(startTime),
			)
			log.Println("------------------------------------------------------------")

			return nil
		}

		// ----------------------------------------------------
		// Stream error
		// ----------------------------------------------------

		if err != nil {

			log.Println("------------------------------------------------------------")
			log.Printf(
				"MDT gRPC STREAM ERROR: %v",
				err,
			)

			log.Printf(
				"Messages received: %d",
				messageCount,
			)

			log.Printf(
				"Stream duration: %s",
				time.Since(startTime),
			)

			log.Println("------------------------------------------------------------")

			return err
		}

		messageCount++

		log.Println()
		log.Println("============================================================")
		log.Printf(
			"MDT MESSAGE #%d RECEIVED",
			messageCount,
		)
		log.Println("============================================================")

		if msg == nil {

			log.Println(
				"WARNING: Received nil MdtDialoutArgs",
			)

			continue
		}

		// ----------------------------------------------------
		// MDT envelope
		// ----------------------------------------------------

		log.Printf(
			"ReqId     : %d",
			msg.GetReqId(),
		)

		log.Printf(
			"Data size : %d bytes",
			len(msg.GetData()),
		)

		log.Printf(
			"TotalSize : %d",
			msg.GetTotalSize(),
		)

		log.Printf(
			"Errors    : %q",
			msg.GetErrors(),
		)

		// ----------------------------------------------------
		// EOK is success
		// ----------------------------------------------------

		if msg.GetErrors() != "" &&
			!strings.EqualFold(msg.GetErrors(), "EOK") {

			log.Printf(
				"WARNING: Nexus reported MDT error: %s",
				msg.GetErrors(),
			)
		}

		// ----------------------------------------------------
		// Empty payload
		// ----------------------------------------------------

		if len(msg.GetData()) == 0 {

			log.Println(
				"MDT message contains no data",
			)

			continue
		}

		// ----------------------------------------------------
		// Raw payload
		// ----------------------------------------------------

		dumpBytes(
			"MDT payload",
			msg.GetData(),
			128,
		)

		// ----------------------------------------------------
		// Decode telemetry
		// ----------------------------------------------------

		parseTelemetry(
			msg.GetData(),
		)

		log.Println()
		log.Println("============================================================")
	}
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

func main() {

	// --------------------------------------------------------
	// Logging
	// --------------------------------------------------------

	log.SetFlags(
		log.Ldate |
			log.Ltime |
			log.Lmicroseconds |
			log.LUTC,
	)

	log.SetOutput(os.Stdout)

	log.Println("============================================================")
	log.Println("Cisco Nexus NX-OS MDT Telemetry Collector")
	log.Println("============================================================")

	// --------------------------------------------------------
	// TCP listener
	// --------------------------------------------------------

	log.Printf(
		"Creating TCP listener on %s",
		listenAddress,
	)

	listener, err := net.Listen(
		"tcp",
		listenAddress,
	)

	if err != nil {

		log.Fatalf(
			"FAILED to listen on %s: %v",
			listenAddress,
			err,
		)
	}

	log.Printf(
		"TCP listener successfully created on %s",
		listenAddress,
	)

	log.Printf(
		"Listening address: %s",
		listener.Addr().String(),
	)

	// --------------------------------------------------------
	// gRPC server
	// --------------------------------------------------------

	log.Println("Creating gRPC server")

	server := grpc.NewServer()

	// --------------------------------------------------------
	// Register Cisco MDT service
	// --------------------------------------------------------

	log.Println(
		"Registering Cisco gRPCMdtDialout service",
	)

	mdt_dialout.RegisterGRPCMdtDialoutServer(
		server,
		&MDTServer{},
	)

	log.Println(
		"Cisco gRPCMdtDialout service registered successfully",
	)

	// --------------------------------------------------------
	// Startup
	// --------------------------------------------------------

	log.Println()
	log.Println("============================================================")
	log.Println("COLLECTOR READY")
	log.Println("============================================================")

	log.Printf("Protocol : gRPC")
	log.Printf("Address  : %s", listenAddress)
	log.Printf("Port     : 1164")
	log.Printf("TLS      : disabled")
	log.Printf("Service  : gRPCMdtDialout")

	log.Println()
	log.Println("Supported paths:")
	log.Println("  show version")
	log.Println("  sys/intf/phys")
	log.Println()
	log.Println("Waiting for Cisco Nexus MDT connection...")
	log.Println("============================================================")

	// --------------------------------------------------------
	// Start gRPC server
	// --------------------------------------------------------

	if err := server.Serve(listener); err != nil {

		log.Fatalf(
			"gRPC server stopped with error: %v",
			err,
		)
	}

	log.Println("gRPC server stopped")

	fmt.Println("Collector exited")
}