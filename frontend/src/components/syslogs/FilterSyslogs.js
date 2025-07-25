import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../misc/AxiosConfig';
import '../../css/SearchSyslogs.css';
import customStyles from '../misc/SelectStyles';

const FilterSyslogs = ({ source, devices, trapOids, onSelectedTagsChange, onSelectedTagsSearch }) => {
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState({});
    const [tagOptions, setTagOptions] = useState({});
    const [fetchedTags, setFetchedTags] = useState({});
    const [mnemonics, setMnemonics] = useState([]);
    console.log('Agent devices:', devices);

    const netflowTags = [
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Destination IP', value: 'destination_ip' },
        { label: 'Protocol', value: 'protocol' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Destination Port', value: 'destination_port' }
    ];

    console.log('Devices in FilterSyslogs:', devices);

    // Convert devices into Select options
    const deviceOptions = devices.map(device => ({
        value: device.ip_address,
        label: device.hostname,
        ip_address: device.ip_address
    }));

    const fetchMnemonics = async () => {
        try {
            const response = await apiClient.get('/syslogs/mnemonics/');
            const mnemonics = response.data.map((mnemonic) => ({
                value: mnemonic.name,
                label: mnemonic.name,
            }));
            setMnemonics(mnemonics);
        } catch (error) {
            console.error('Error fetching mnemonic data:', error);
        }
    };

    const fetchTrapTags = async () => {
        try {
            const response = await apiClient.get('/traps/tags/');
            const trapTags = response.data.map((tag) => ({
                label: tag.name, // Assuming your trap tag API returns 'name'
                value: tag.name,
            }));
            setTags(trapTags);
        } catch (error) {
            console.error('Error fetching trap tags:', error);
        }
    };

    const fetchSyslogTags = async () => {
        try {
            const response = await apiClient.get('/syslogs/tags/');
            const syslogTags = response.data.map((tag) => ({
                label: tag.name,
                value: tag.name,
            }));
            setTags(syslogTags);
        } catch (error) {
            console.error('Error fetching syslog tags:', error);
        }
    };

    const fetchSyslogTagOptions = async (tag) => {
        if (fetchedTags[tag]) return; // Avoid fetching if already fetched

        try {
            const response = await apiClient.get(`/syslogs/tags/unique-values`, {
                params: { field: tag }
            });

            const optionsArray = response.data;
            if (optionsArray) {
                setTagOptions((prevOptions) => ({
                    ...prevOptions,
                    [tag]: optionsArray.map((option) => ({
                        value: option,
                        label: option,
                    })),
                }));
                setFetchedTags((prevFetchedTags) => ({
                    ...prevFetchedTags,
                    [tag]: true,
                }));
            }
        } catch (error) {
            console.error(`Error fetching options for ${tag}: `, error);
        }
    };

    const fetchTrapTagOptions = async (tag) => {
        if (fetchedTags[tag]) return;

        try {
            const response = await apiClient.get(`/traps/tags/unique-values`, {
                params: { field: tag } // Assuming your API for trap tag values uses 'field' as well
            });
            const optionsArray = response.data;
            if (optionsArray) {
                setTagOptions(prevOptions => ({
                    ...prevOptions,
                    [tag]: optionsArray.map(option => ({ value: option, label: option }))
                }));
                setFetchedTags(prevFetchedTags => ({ ...prevFetchedTags, [tag]: true }));
            }
        } catch (error) {
            console.error(`Error fetching options for trap tag ${tag}:`, error);
        }
    };


    useEffect(() => {
        if (source === "syslogs") {
            fetchSyslogTags();
        } else if (source === "snmptraps") {
            fetchTrapTags();
        } else if (source === "netflow") {
            setTags(netflowTags);
        }
    }, [source]);

    const handleFocus = (tag) => {
        if (tag === "mnemonics") {
            fetchMnemonics();
        } else if (source === "syslogs") {
            fetchSyslogTagOptions(tag);
        } else if (source === "snmptraps") {
            fetchTrapTagOptions(tag);
        }
    };

    const handleChange = (selectedValues, tag) => {
        const updatedSelectedTags = {
            ...selectedTags,
            [tag]: selectedValues,
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedTagsChange(updatedSelectedTags);
    };

    const handleAgentChange = (selectedValues) => {
        const updatedSelectedTags = {
            ...selectedTags,
            device: selectedValues,
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedTagsChange(updatedSelectedTags);
    };

    const handleSeverityChange = (selectedValues) => {
        const updatedSelectedTags = {
            ...selectedTags,
            severity: selectedValues,
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedTagsChange(updatedSelectedTags);
    };


    const handleSearchClick = () => {
        const filters = {
            device: selectedTags.device ? selectedTags.device.map((opt) => opt.value) : [],
            severity: selectedTags.severity ? selectedTags.severity.map((opt) => opt.value) : [],
            mnemonic: selectedTags.mnemonic ? selectedTags.mnemonic.map((opt) => opt.value) : [],
            snmpTrapOid: selectedTags.snmpTrapOid ? selectedTags.snmpTrapOid.map((opt) => opt.value) : [],
            tags: Object.keys(selectedTags).reduce((acc, key) => {
                if (key !== 'device' && key !== 'mnemonic' && key !== 'snmpTrapOid') {
                    acc[key] = selectedTags[key] ? selectedTags[key].map((opt) => opt.value) : [];
                }
                return acc;
            }, {}),
        };
        onSelectedTagsSearch(filters);
    };

    const severityOptions = [
        { value: 'Emergency', label: 'Emergency' },
        { value: 'Alert', label: 'Alert' },
        { value: 'Critical', label: 'Critical' },
        { value: 'Error', label: 'Error' },
        { value: 'Warning', label: 'Warning' },
        { value: 'Notice', label: 'Notice' },
        { value: 'Informational', label: 'Informational' },
        { value: 'Debug', label: 'Debug' }
    ];

    return (
        <div className="searchSyslogsContainer">
            {tags.length === 0 && source !== 'traps' && source !== 'syslog' ? (
                <p style={{ textAlign: 'center' }}>No specific tags to filter.</p>
            ) : tags.length === 0 ? (
                <p style={{ textAlign: 'center' }}>Loading {source} tags...</p>
            ) : (
                <div className="searchSyslogsFilterEntries">
                    {/* Agent Hostnames Field */}
                    <div className="searchSyslogsFilterEntry">
                        <span className="searchSignalFilterText">Device:</span>
                        <div style={{ marginTop: '6px' }}>
                            <Select
                                options={deviceOptions}
                                isMulti
                                value={selectedTags.device}
                                onChange={(selectedValues) => handleAgentChange(selectedValues)}
                                styles={{
                                    ...customStyles('375px'),
                                    menuPortal: base => ({ ...base, zIndex: 9999 })
                                }}
                                menuPortalTarget={document.body}
                                placeholder="Select devices"
                            />
                        </div>
                    </div>

                    {/* Mnemonic Field for Syslogs */}
                    {source === "syslogs" && (

                        <div className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">Mnemonic:</span>
                            <div style={{ marginTop: '6px' }}>
                                <Select
                                    options={mnemonics || []}  // Use dynamically fetched options
                                    isMulti
                                    value={selectedTags.mnemonic || []}    // Make sure it's never undefined/null
                                    onChange={(selectedValues) => handleChange(selectedValues, 'mnemonic')}
                                    name="mnemonics"
                                    onFocus={() => handleFocus("mnemonics")}
                                    styles={{
                                        ...customStyles('375px'),
                                        menuPortal: base => ({ ...base, zIndex: 9999 })
                                    }}
                                    menuPortalTarget={document.body}
                                    placeholder="Select mnemonics"
                                />
                            </div>
                        </div>
                    )}

                    {source === "syslogs" && (

                        <div className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">Severity:</span>
                            <div style={{ marginTop: '6px' }}>
                                <Select
                                    options={severityOptions}
                                    isMulti
                                    value={selectedTags.severity || []}
                                    onChange={(selectedValues) => handleSeverityChange(selectedValues)}
                                    name="severity"
                                    styles={{
                                        ...customStyles('375px'),
                                        menuPortal: base => ({ ...base, zIndex: 9999 })
                                    }}
                                    menuPortalTarget={document.body}
                                    placeholder="Select severity"
                                />
                            </div>
                        </div>
                    )}

                    {/* SnmpTrapOid Field for Traps */}
                    {source === 'snmptraps' && (
                        <div className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">SNMP Trap OID:</span>
                            <div style={{ marginTop: '6px' }}>
                                <Select
                                    options={trapOids}
                                    isMulti
                                    value={selectedTags.snmpTrapOid}
                                    onChange={(selectedValues) => handleChange(selectedValues, 'snmpTrapOid')}
                                    name="snmpTrapOid"
                                    onFocus={() => handleFocus('snmpTrapOid')}
                                    styles={{
                                        ...customStyles('375px'),
                                        menuPortal: base => ({ ...base, zIndex: 9999 })
                                    }}
                                    menuPortalTarget={document.body}
                                    placeholder="Select SNMP Trap OIDs"
                                />
                            </div>
                        </div>
                    )}

                    {/* Dynamic Tags */}
                    {tags.map((tag) => (
                        <div key={tag.label} className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">{tag.label}:</span>
                            <div style={{ marginTop: '6px' }}>
                                <Select
                                    options={tagOptions[tag.label] || []}
                                    isMulti
                                    value={selectedTags[tag.label]}
                                    onChange={(selectedValues) => handleChange(selectedValues, tag.label)}
                                    name={tag.label}
                                    onFocus={() => handleFocus(tag.label)}
                                    styles={{
                                        ...customStyles('375px'),
                                        menuPortal: base => ({ ...base, zIndex: 9999 })
                                    }}
                                    menuPortalTarget={document.body}
                                    placeholder={`Select ${tag.label}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', width: '100%', justifyContent: 'center', margin: '10px' }}>
                <button onClick={handleSearchClick} className="button save-button">
                    Search
                </button>
            </div>
        </div>
    );
};

export default FilterSyslogs;