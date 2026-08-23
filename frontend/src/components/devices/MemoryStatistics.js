import { useState, useEffect, useRef } from "react";

import {
    RadialBarChart,
    PolarAngleAxis,
    RadialBar,
    Cell,
    ResponsiveContainer
} from "recharts";

import {
    PiDatabaseDuotone
} from "react-icons/pi";

import "../../css/CpuUtilizationModern.css";

import useDeviceStatus from "../../hooks/useDeviceStatus";


function MemoryStatistics({ selectedDevice, keycloak }) {

    const socketRef = useRef(null);


    const [error, setError] = useState("");
    const [memoryLoading, setMemoryLoading] = useState(false);
    const [memoryTimestamp, setMemoryTimestamp] = useState(null);



    const [memoryChartData, setMemoryChartData] = useState([
        {
            name: "Used Memory",
            value: 0,
            label: "Used Memory"
        },
        {
            name: "Used RAM",
            value: 0,
            label: "Used RAM"
        },
        {
            name: "Free RAM",
            value: 0,
            label: "Free RAM"
        }
    ]);



    /*
        Initial Redis snapshot
    */
    const {
        data: initialMemory,
        loading: initialLoading,
        error: initialError

    } = useDeviceStatus(
        keycloak,
        selectedDevice,
        "memory"
    );




    /*
        Shared handler:
        REST + WebSocket
    */
    const handleMemoryUpdate = (msg) => {


        if (!msg)
            return;



        const stats = msg.stats || {};



        const totalMemory = Number(
            stats["total-memory"] ?? 0
        );


        const usedMemory = Number(
            stats["used-memory"] ?? 0
        );


        const freeMemory = Number(
            stats["free-memory"] ?? 0
        );



        const usage = Number(
            stats["usage"] ??
            (
                totalMemory > 0
                    ? (usedMemory / totalMemory) * 100
                    : 0
            )
        );



        setMemoryChartData([

            {
                name: "Used Memory",
                value: Math.min(
                    usage,
                    100
                ),
                label: "Used Memory"
            },


            {
                name: "Used RAM",
                value: Math.min(
                    totalMemory > 0
                        ? (usedMemory / totalMemory) * 100
                        : 0,
                    100
                ),
                label: "Used RAM"
            },


            {
                name: "Free RAM",
                value: Math.min(
                    totalMemory > 0
                        ? (freeMemory / totalMemory) * 100
                        : 0,
                    100
                ),
                label: "Free RAM"
            }

        ]);



        setMemoryTimestamp(
            msg.timestamp ?? null
        );


        setError("");
        setMemoryLoading(false);

    };





    /*
        Load initial REST data
    */
    useEffect(() => {


        if(initialMemory){

            console.log(
                "Initial Memory:",
                initialMemory
            );


            handleMemoryUpdate(
                initialMemory
            );

        }


    }, [initialMemory]);






    /*
        WebSocket live updates
    */
    useEffect(() => {


        if(!selectedDevice?.hostname)
            return;



        const protocol =
            window.location.protocol === "https:"
                ? "wss"
                : "ws";



        const ws = new WebSocket(

            `${protocol}://${window.location.host}/ws/memory?device=${selectedDevice.hostname}`

        );



        socketRef.current = ws;


        setMemoryLoading(true);



        ws.onopen = () => {

            console.log(
                "🔌 Memory WS connected"
            );

        };




        ws.onmessage = (event) => {


            try {


                const msg = JSON.parse(
                    event.data
                );


                console.log(
                    "Memory WS:",
                    msg
                );



                if(msg.type === "memory-util"){

                    handleMemoryUpdate(
                        msg
                    );

                }


            }
            catch(err){

                console.error(
                    "Memory WS parse error:",
                    err
                );


                setError(
                    "Invalid memory WS data"
                );

            }

        };




        ws.onerror = () => {

            setError(
                "Memory websocket error"
            );

        };




        ws.onclose = () => {


            console.log(
                "❌ Memory WS closed"
            );


            socketRef.current = null;

        };




        return () => {


            if(socketRef.current){

                socketRef.current.close();

                socketRef.current = null;

            }


        };


    }, [
        selectedDevice?.hostname
    ]);






    const getSeverityColor = (value) => {


        if(value >= 90)
            return "var(--color-critical)";


        if(value >= 75)
            return "var(--color-warning)";


        return "var(--color-healthy)";

    };




    const getColorClass = (value) => {


        if(value >= 90)
            return "text-critical";


        if(value >= 75)
            return "text-warning";


        return "text-healthy";

    };





    return (

        <div
            className="cpu-monitor-card"
            style={{
                width: "calc(50% - 10px)",
                marginLeft: "15px"
            }}
        >


            <div className="info-header">

                <div className="header-title">


                    <PiDatabaseDuotone
                        style={{
                            fontSize:18
                        }}
                    />


                    <h2>
                        Memory Statistics
                    </h2>


                </div>

            </div>





            <div className="cpu-monitor-content">


                <div className="chart-container">


                    <ResponsiveContainer
                        width="100%"
                        height="100%"
                    >


                        <RadialBarChart

                            cx="50%"
                            cy="50%"

                            innerRadius="45%"
                            outerRadius="100%"

                            barSize={8}

                            data={memoryChartData}

                            startAngle={90}
                            endAngle={-270}

                        >


                            <RadialBar

                                background={{
                                    fill:"var(--bg-track)"
                                }}

                                dataKey="value"

                                cornerRadius={4}

                            >


                                {
                                    memoryChartData.map(
                                        entry => (

                                        <Cell

                                            key={entry.name}

                                            fill={
                                                getSeverityColor(
                                                    entry.value
                                                )
                                            }

                                        />

                                    ))
                                }


                            </RadialBar>



                            <PolarAngleAxis

                                type="number"

                                domain={[
                                    0,
                                    100
                                ]}

                                tick={false}

                            />


                        </RadialBarChart>


                    </ResponsiveContainer>





                    <button

                        className={
                            `center-action-btn ${
                                memoryLoading ||
                                initialLoading
                                ? "is-loading"
                                : ""
                            }`
                        }

                        title="Live Memory Stream"

                    >

                        <PiDatabaseDuotone />

                    </button>


                </div>







                <div className="metrics-sidebar">


                    {
                        (error || initialError) &&

                        <div className="metrics-error-banner">

                            {
                                error ||
                                initialError?.message
                            }

                        </div>

                    }






                    <div className="telemetry-rows">


                        {
                            [...memoryChartData]
                            .reverse()
                            .map(stat => (


                                <div

                                    className="metric-row"

                                    key={stat.name}

                                >


                                    <div className="metric-meta">


                                        <span

                                            className={
                                                `status-dot ${
                                                    getColorClass(
                                                        stat.value
                                                    )
                                                }`
                                            }

                                        />



                                        <span className="metric-label">

                                            {stat.label}

                                        </span>


                                    </div>





                                    <div

                                        className={
                                            `metric-value ${
                                                getColorClass(
                                                    stat.value
                                                )
                                            }`
                                        }

                                    >

                                        {stat.value.toFixed(1)}%

                                    </div>



                                </div>


                            ))

                        }


                    </div>


                </div>


            </div>


        </div>

    );

}


export default MemoryStatistics;