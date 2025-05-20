import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import axios from 'axios';
import '../../css/SearchSyslogs.css';
import customStyles from '../misc/SelectStyles';

const FilterTraps = ({ tags, hostnames, snmpTrapOids, onSelectedTagsChange, onSelectedTagsSearch }) => {
    const [selectedTags, setSelectedTags] = useState({});
    const [tagOptions, setTagOptions] = useState({});
    const [fetchedTags, setFetchedTags] = useState({});
    const [agentOptions, setAgentOptions] = useState([]);
    const [mnemonicOptions, setMnemonicOptions] = useState([]);
    const baseUrl = `http://${process.env.REACT_APP_SERVER_IP}:${process.env.REACT_APP_SERVER_PORT}`;

    const fetchTagOptions = async (tag) => {
        if (fetchedTags[tag]) return; // Avoid fetching if already fetched

        try {
            const response = await axios.get(`${baseUrl}/snmptraps/api/getTrapTags/${tag}/`);
            const optionsArray = response.data[tag];
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
            console.error(`Error fetching options for ${tag}:`, error);
        }
    };

    const handleFocus = (tag) => {
        fetchTagOptions(tag); // Fetch options when input is focused
    };

    const handleChange = (selectedValues, tag) => {
        const updatedSelectedTags = {
            ...selectedTags,
            [tag]: selectedValues
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedTagsChange(updatedSelectedTags);
    };

    const handleAgentChange = (selectedValues) => {
        const updatedSelectedTags = {
            ...selectedTags,
            agent: selectedValues
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedTagsChange(updatedSelectedTags);
    };

    const handleMnemonicChange = (selectedValues) => {
        const updatedSelectedTags = {
            ...selectedTags,
            mnemonic: selectedValues
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedTagsChange(updatedSelectedTags);
    };

    const handleSearchClick = () => {
        const filters = {
            agent: selectedTags.agent ? selectedTags.agent.map(opt => opt.value) : [],
            mnemonic: selectedTags.mnemonic ? selectedTags.mnemonic.map(opt => opt.value) : [],
            tags: Object.keys(selectedTags).reduce((acc, key) => {
                if (key !== 'agent' && key !== 'mnemonic') {
                    acc[key] = selectedTags[key].map(opt => opt.value);
                }
                return acc;
            }, {})
        };
        onSelectedTagsSearch(filters);
    };

    console.log('hostnames in searchSnmpTraps component:', hostnames);

    return (
        <div className="searchSyslogsContainer">
            {tags.length === 0 ? (
                <p style={{ textAlign: 'center' }}>Loading syslog tags...</p>
            ) : (
                <div className="searchSyslogsFilterEntries">
                    {/* Agent Field */}
                    <div className="searchSyslogsFilterEntry" style={{ marginTop: '0px' }}>
                        <span className="searchSignalFilterText">Agent:</span>
                        <div style={{ marginTop: '4px' }}>
                            <Select
                                options={hostnames}
                                isMulti
                                value={selectedTags.agent}
                                onChange={handleAgentChange}
                                styles={customStyles('360px')}
                            />
                        </div>
                    </div>

                    {/* Mnemonic Field */}
                    <div className="searchSyslogsFilterEntry">
                        <span className="searchSignalFilterText">SNMP Trap OID:</span>
                        <div style={{ marginTop: '4px' }}>
                            <Select
                                options={snmpTrapOids}
                                isMulti
                                value={selectedTags.mnemonic}
                                onChange={handleMnemonicChange}
                                styles={customStyles('360px')}
                            />
                        </div>
                    </div>

                    {/* Dynamic Syslog Tags */}
                    {tags.map((tag, index) => (
                        <div key={index} className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">{tag}:</span>
                            <div style={{ marginTop: '4px' }}>
                                <Select
                                    options={tagOptions[tag] || []}
                                    isMulti
                                    value={selectedTags[tag]}
                                    onChange={(selectedValues) => handleChange(selectedValues, tag)}
                                    name={tag}
                                    onFocus={() => handleFocus(tag)}
                                    styles={customStyles('360px')}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="searchButtonContainer">
                <button onClick={handleSearchClick} className="searchButton">Search</button>
            </div>
        </div>
    );
};

export default FilterTraps;