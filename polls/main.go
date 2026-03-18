package main

import (
    "fmt"
    "log"
    "time"

    "github.com/gosnmp/gosnmp"
)

func main() {
    target := "192.168.1.1" // Your device IP
    oids := []string{
        "1.3.6.1.2.1.1.1.0", // sysDescr
        "1.3.6.1.2.1.1.3.0", // sysUpTime
    }

    // Configure SNMPv3 session
    g := &gosnmp.GoSNMP{
        Target:    target,
        Port:      1161,
        Version:   gosnmp.Version3,
        Timeout:   time.Duration(5) * time.Second,
        Retries:   3,
        MsgFlags:  gosnmp.AuthPriv,
        SecurityModel: gosnmp.UserSecurityModel,
        SecurityParameters: &gosnmp.UsmSecurityParameters{
            UserName:                 "SNMPv3",
            AuthenticationProtocol:   gosnmp.SHA,
            AuthenticationPassphrase: "AuTH_P@55w0rd123!",
            PrivacyProtocol:          gosnmp.AES,
            PrivacyPassphrase:        "PrIV@TE_P@55w0rd456!",
        },
    }

    err := g.Connect()
    if err != nil {
        log.Fatalf("Connect() err: %v", err)
    }
    defer g.Conn.Close()

    fmt.Println("✅ SNMP poller started. Polling every 1 minute...")

    ticker := time.NewTicker(1 * time.Minute)
    defer ticker.Stop()

    // Poll immediately before waiting for the first tick
    pollSNMP(g, oids)

    for range ticker.C {
        pollSNMP(g, oids)
    }
}

func pollSNMP(g *gosnmp.GoSNMP, oids []string) {
    fmt.Printf("\n📡 Polling device at %v\n", time.Now().Format("15:04:05"))

    result, err := g.Get(oids)
    if err != nil {
        log.Printf("SNMP GET error: %v", err)
        return
    }

    for _, v := range result.Variables {
        fmt.Printf("OID: %s\n", v.Name)
        switch v.Type {
        case gosnmp.OctetString:
            fmt.Printf("  Value: %s\n", string(v.Value.([]byte)))
        default:
            fmt.Printf("  Value: %v\n", v.Value)
        }
    }
}
