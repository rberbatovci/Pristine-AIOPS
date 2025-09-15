import React, { useEffect } from 'react';
import '../css/Signals.css';
import { FaLinkedin } from "react-icons/fa6";
import { SiGmail } from "react-icons/si";

const logoUrl = '/images/your-logo.png'; // replace with actual logo path

const Incidents = ({ currentUser, setDashboardTitle }) => {
    useEffect(() => {
        setDashboardTitle("Premium Incidents Dashboard");
        return () => setDashboardTitle('');
    }, [setDashboardTitle]);

    return (
        <div
            style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '80vh',
                width: '100vw'
            }}
        >
            <div
                className="mainContainer"
                style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    textAlign: "center",
                    padding: "20px",
                    width: "630px",
                    height: "400px",
                    paddingTop: "40px",
                }}
            >
                {/* Welcome Message */}
                <p>Welcome to our Premium Dashboard!</p>

                <h1
                    style={{
                        color: "var(--tagListColHov)",
                        fontFamily: "'Russo One', sans-serif"
                    }}
                >
                    Pristine-AIOPS
                </h1>

                <div
                    style={{
                        background: 'var(--backgroundColor3)',
                        padding: '20px',
                        borderRadius: '10px',
                        marginTop: '30px',
                        marginBottom: '10px'
                    }}
                >
                    <p
                        style={{
                            marginTop: "15px",
                            maxWidth: "600px",
                            lineHeight: "1.6"
                        }}
                    >
                        This premium Incidents Dashboard is meticulously crafted and requires a
                        detailed low-level network design to tailor it perfectly to your client's
                        specific network infrastructure. We ensure optimal performance and insights
                        by integrating deeply with your unique environment.
                    </p>

                    <p style={{ marginTop: "25px", fontSize: "1rem" }}>
                        To discuss a customized solution, please contact us:
                    </p>

                    {/* Contact Links with Icons */}
                    <div style={{ marginTop: "15px" }}>
                        <p style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            <FaLinkedin style={{ color: '#0A66C2', fontSize: '1.5rem' }} />
                            <a
                                href="https://www.linkedin.com/in/rilind-i-berbatovci-81ab4917a/"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: "var(--searchButtonBack)", textDecoration: 'none' }}
                            >
                                Rilind I. Berbatovci
                            </a>
                        </p>
                        <p
                            style={{
                                marginTop: "10px",
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                            }}
                        >
                            <SiGmail style={{ color: '#D14836', fontSize: '1.5rem' }} />
                            <a
                                href="mailto:rilind.i.berbatovci@gmail.com"
                                style={{ color: "var(--searchButtonBack)", textDecoration: 'none' }}
                            >
                                rilind.i.berbatovci@gmail.com
                            </a>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Incidents;
