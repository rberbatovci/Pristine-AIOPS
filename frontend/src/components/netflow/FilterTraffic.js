import React, { useState } from 'react';
import Select from 'react-select';
import kcFetch from '../misc/kcFetch';
import '../../css/SearchSyslogs.css';
import customStyles from '../misc/SelectStyles';

const FilterTraffic = ({ devices, onSelectedTagsChange, onSelectedTagsSearch, keycloak }) => {
    const [selectedTags, setSelectedTags] = useState({});
    const [tagOptions, setTagOptions] = useState({});
    const [fetchedTags, setFetchedTags] = useState({});

    const netflowTags = [
        { label: 'Source IP', value: 'source_ip' },
        { label: 'Destination IP', value: 'dest_ip' },
        { label: 'Protocol', value: 'protocol' },
        { label: 'Source Port', value: 'source_port' },
        { label: 'Destination Port', value: 'dest_port' },
    ];

    // Convert devices into Select options
    const deviceOptions = devices.map(device => ({
        value: device.ip_address,
        label: device.hostname || device.ip_address,
    }));

    // Fetch unique values for a given NetFlow field
    const fetchNetflowTagOptions = async (tag) => {

        if (fetchedTags[tag]) return;

        try {

            const endpoint = `/netflow/options?fields=${tag}`;

            const data = await kcFetch(keycloak, endpoint);

            const optionsArray = data[tag];

            if (Array.isArray(optionsArray)) {

                setTagOptions((prev) => ({
                    ...prev,
                    [tag]: optionsArray.map(option => ({
                        value: option,
                        label: option,
                    })),
                }));

                setFetchedTags((prev) => ({
                    ...prev,
                    [tag]: true
                }));
            }

        } catch (error) {
            console.error(`Error fetching options for ${tag}:`, error);
        }
    };

    const handleFocus = (tag) => {
        fetchNetflowTagOptions(tag);
    };

    const handleChange = (selectedValues, tag) => {

        const updated = {
            ...selectedTags,
            [tag]: selectedValues
        };

        setSelectedTags(updated);
        onSelectedTagsChange(updated);
    };

    const handleDeviceChange = (selectedValues) => {

        const updated = {
            ...selectedTags,
            device: selectedValues
        };

        setSelectedTags(updated);
        onSelectedTagsChange(updated);
    };

    const handleSearchClick = () => {

        const filters = {
            device: selectedTags.device
                ? selectedTags.device.map(opt => opt.value)
                : [],
            tags: Object.keys(selectedTags).reduce((acc, key) => {

                if (key !== 'device') {
                    acc[key] = selectedTags[key]
                        ? selectedTags[key].map(opt => opt.value)
                        : [];
                }

                return acc;

            }, {}),
        };

        onSelectedTagsSearch(filters);
    };

    return (
        <div className="searchSyslogsContainer">

            <div className="searchSyslogsFilterEntries">

                {/* Device Filter */}
                <div className="searchSyslogsFilterEntry">

                    <span className="searchSignalFilterText">
                        Device:
                    </span>

                    <div style={{ marginTop: '6px' }}>

                        <Select
                            options={deviceOptions}
                            isMulti
                            value={selectedTags.device || []}
                            onChange={handleDeviceChange}
                            styles={{
                                ...customStyles('375px'),
                                menuPortal: base => ({ ...base, zIndex: 9999 })
                            }}
                            menuPortalTarget={document.body}
                            placeholder="Select devices"
                        />

                    </div>
                </div>

                {/* NetFlow Filters */}
                {netflowTags.map((tag) => (

                    <div key={tag.value} className="searchSyslogsFilterEntry">

                        <span className="searchSignalFilterText">
                            {tag.label}:
                        </span>

                        <div style={{ marginTop: '6px' }}>

                            <Select
                                options={tagOptions[tag.value] || []}
                                isMulti
                                value={selectedTags[tag.value] || []}
                                onChange={(selectedValues) =>
                                    handleChange(selectedValues, tag.value)
                                }
                                onFocus={() =>
                                    handleFocus(tag.value)
                                }
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

            <div
                style={{
                    display: 'flex',
                    width: '100%',
                    justifyContent: 'center',
                    margin: '10px'
                }}
            >

                <button
                    onClick={handleSearchClick}
                    className="button save-button"
                >
                    Search
                </button>

            </div>

        </div>
    );
};

export default FilterTraffic;