import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../../misc/AxiosConfig';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';

const Traps = ({ onSelectedTrapsChange, initialSelectedTraps = {} }) => {
    const [snmpTraps, setSnmpTraps] = useState([]);
    const [selectedTraps, setSelectedTraps] = useState({});
    const [trapOptions, setTrapOptions] = useState({});
    const [fetchedOids, setFetchedOids] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchSnmpTraps();
        fetchTrapOidOptions(); // Fetch SNMP Trap Oid options
    }, []);

    useEffect(() => {
        setSelectedTraps(prevTraps => ({
            ...prevTraps,
            ...initialSelectedTraps
        }));
    }, [initialSelectedTraps]);

    const fetchSnmpTraps = () => {
        setIsLoading(true);
        apiClient
            .get('/snmptraps/oid/oidlist/')
            .then((response) => {
                // Response is an array, not an object
                const oidNames = response.data; 
                const formattedTraps = oidNames.map((name) => ({
                    value: name,
                    label: name,
                }));
                setSnmpTraps(formattedTraps);
    
                const initialTraps = { ...initialSelectedTraps };
                formattedTraps.forEach(trap => {
                    if (!initialTraps[trap.value]) {
                        initialTraps[trap.value] = [];
                    }
                });
                setSelectedTraps(initialTraps);
                onSelectedTrapsChange(initialTraps);
                setIsLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching SNMP Traps: ', error);
                setIsLoading(false);
            });
    };

    const fetchTrapOidOptions = () => {
        apiClient
            .get('/snmptraps/trapoid/')
            .then((response) => {
                const trapOids = response.data;
                const options = trapOids.map((trap) => ({
                    value: trap.value,
                    label: trap.name ? `${trap.name} (${trap.value})` : trap.value,
                }));
                setTrapOptions((prevOptions) => ({
                    ...prevOptions,
                    SNMPTrapOid: options,
                }));
            })
            .catch((error) => {
                console.error('Error fetching SNMP Trap Oid options: ', error);
            });
    };

    const fetchOidOptions = (oid) => {
        if (fetchedOids[oid]) return;

        apiClient
            .get(`/signals/api/getAffectedEntities/${oid}/`)
            .then((response) => {
                const optionsArray = response.data[oid];
                if (optionsArray) {
                    setTrapOptions((prevOptions) => ({
                        ...prevOptions,
                        [oid]: optionsArray.map((option) => ({
                            value: option,
                            label: option,
                        })),
                    }));
                    setFetchedOids((prevFetchedOids) => ({
                        ...prevFetchedOids,
                        [oid]: true,
                    }));
                }
            })
            .catch((error) => {
                console.error(`Error fetching options for ${oid}: `, error);
            });
    };

    const handleChange = (selectedValues, trap) => {
        const updatedSelectedTraps = {
            ...selectedTraps,
            [trap.value]: selectedValues
        };
        setSelectedTraps(updatedSelectedTraps);
        onSelectedTrapsChange(updatedSelectedTraps);
    };

    const handleFocus = (trap) => {
        fetchOidOptions(trap.value);
    };

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            {isLoading ? (
                <div>
                    <p style={{ textAlign: 'center' }}>Loading SNMP Traps...</p>
                </div>
            ) : (
                <div className="search-signals-container">
                    <div className="search-signals-item">
                        <p>SNMP Trap Oid:</p>
                        <Select
                            options={trapOptions['SNMPTrapOid'] || []}
                            isMulti
                            value={selectedTraps['SNMPTrapOid']}
                            onChange={(selectedValues) => handleChange(selectedValues, { value: 'SNMPTrapOid' })}
                            styles={customStyles}
                        />
                    </div>
                    {snmpTraps.map((trap, index) => (
                        <div key={index} className="search-signals-item">
                            <p>{trap.label}:</p>
                            <Select
                                options={trapOptions[trap.value] || []}
                                isMulti
                                value={selectedTraps[trap.value] || []}
                                onChange={(selectedValues) => handleChange(selectedValues, trap)}
                                onFocus={() => handleFocus(trap)}
                                name={trap.value}
                                styles={customStyles}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Traps;
