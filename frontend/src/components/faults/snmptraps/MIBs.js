import { useState, useEffect, useRef } from 'react';
import '../../../css/SyslogTagsList.css';
import { IoMdAddCircleOutline, IoMdAddCircle } from "react-icons/io";
import { RiDeleteBin6Line } from "react-icons/ri";
import { useMibs } from "../../../hooks/useSnmpMibs";

const MIBs = ({ keycloak }) => {

    const {
        mibs,
        loading,
        uploadMib,
        deleteMib,
        fetchMibs
    } = useMibs(keycloak);

    const [searchValue, setSearchValue] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchMibs();
    }, [fetchMibs]);

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        await uploadMib(file);
    };

    const triggerFileInput = () => {
        fileInputRef.current.click();
    };

    const filteredMibs = mibs.filter(mib =>
        mib.toLowerCase().includes(searchValue.toLowerCase())
    );

    return (
        <div className="signalTagContainer">

            {loading && <p>Loading SNMP MIBs...</p>}

            {!loading && (
                <div style={{
                    padding: '10px',
                    height: '350px',
                    overflowY: 'auto',
                    background: 'var(--backgroundColor3)',
                    borderRadius: '8px',
                    display: 'block'
                }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <input
                            type="text"
                            placeholder="Search MIBs..."
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="searchTagListElement"
                            style={{
                                background: 'var(--buttonBackground)',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                outline: 'none',
                                width: '220px'
                            }}
                        />

                        <button className="iconButton" onClick={triggerFileInput}>
                            <IoMdAddCircleOutline className="defaultIcon hasFilters" />
                            <IoMdAddCircle className="hoverIcon" />
                        </button>

                        <input
                            type="file"
                            accept=".mib,.txt"
                            style={{ display: 'none' }}
                            ref={fileInputRef}
                            onChange={handleFileChange}
                        />
                    </div>

                    <div style={{ marginTop: '10px' }}>
                        <ul style={{ marginTop: '10px' }}>
                            {filteredMibs.map((mib, index) => (
                                <li key={index} className="signalTagItem">
                                    <span>{mib}</span>

                                    <button
                                        onClick={() => deleteMib(mib)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'red'
                                        }}
                                        title="Delete MIB"
                                    >
                                        <RiDeleteBin6Line />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                </div>
            )}
        </div>
    );
};

export default MIBs;