import React, { useState } from 'react';
import Select from 'react-select';
import apiClient from '../misc/AxiosConfig';
import '../../css/SearchSyslogs.css';
import customStyles from '../misc/SelectStyles';

const FilterSyslogs = ({ tags, devices, mnemonics, onSelectedTagsChange, onSelectedTagsSearch }) => {
    const [selectedTags, setSelectedTags] = useState({});
    const [tagOptions, setTagOptions] = useState({});
    const [fetchedTags, setFetchedTags] = useState({});
    console.log('Agent devices:', devices)
    // Convert devices into Select options
    const agentHostnameOptions = devices.map(device => ({
        value: device.id,  // Use the device id as the value
        label: device.hostname  // Use the hostname as the label
    }));

    const fetchTagOptions = async (tag) => {
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

    const handleFocus = (tag) => {
        fetchTagOptions(tag); // Fetch options when input is focused
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
            agentHostnames: selectedValues,
        };
        setSelectedTags(updatedSelectedTags);
        // Pass the selected device IDs to the parent component
        onSelectedTagsChange(updatedSelectedTags);
    };

    const handleSearchClick = () => {
        const filters = {
            agent: selectedTags.agentHostnames ? selectedTags.agentHostnames.map((opt) => opt.value) : [],
            mnemonic: selectedTags.mnemonic ? selectedTags.mnemonic.map((opt) => opt.value) : [],
            tags: Object.keys(selectedTags).reduce((acc, key) => {
                if (key !== 'agentHostnames' && key !== 'mnemonic' && key !== 'agentAddresses') {
                    acc[key] = selectedTags[key].map((opt) => opt.value);
                }
                return acc;
            }, {}),
        };
        onSelectedTagsSearch(filters);
    };

    return (
        <div className="searchSyslogsContainer">
            {tags.length === 0 ? (
                <p style={{ textAlign: 'center' }}>Loading syslog tags...</p>
            ) : (
                <div className="searchSyslogsFilterEntries">
                    {/* Agent Hostnames Field */}
                    <div className="searchSyslogsFilterEntry">
                        <span className="searchSignalFilterText">Agent Hostnames:</span>
                        <div style={{marginTop: '6px'}}>
                            <Select
                                options={agentHostnameOptions}  // Use the prepared options
                                isMulti
                                value={selectedTags.agentHostnames}
                                onChange={handleAgentChange}  // Updated to use the new function
                                styles={customStyles('360px')}
                                placeholder="Select agent hostnames"
                            />
                        </div>
                    </div>

                    {/* Mnemonic Field */}
                    <div className="searchSyslogsFilterEntry">
                        <span className="searchSignalFilterText">Mnemonic:</span>
                        <div style={{marginTop: '6px'}}>
                            <Select
                                options={mnemonics}
                                isMulti
                                value={selectedTags.mnemonic}
                                onChange={(selectedValues) => handleChange(selectedValues, 'mnemonic')}
                                styles={customStyles('360px')}
                                placeholder="Select mnemonics"
                            />
                        </div>
                    </div>

                    {/* Dynamic Syslog Tags */}
                    {tags.map((tag, index) => (
                        <div key={index} className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">{tag}:</span>
                            <div style={{marginTop: '6px'}}>
                                <Select
                                    options={tagOptions[tag] || []}
                                    isMulti
                                    value={selectedTags[tag]}
                                    onChange={(selectedValues) => handleChange(selectedValues, tag)}
                                    name={tag}
                                    onFocus={() => handleFocus(tag)}
                                    styles={customStyles('360px')}
                                    placeholder={`Select ${tag}`}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
            <div className="searchButtonContainer">
                <button onClick={handleSearchClick} className="searchButton">
                    Search
                </button>
            </div>
        </div>
    );
};

export default FilterSyslogs;
