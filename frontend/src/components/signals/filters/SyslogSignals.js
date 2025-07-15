import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../../misc/AxiosConfig';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';

const SyslogSignalFilters = ({ onSelectedSyslogFiltersChange, initialSelectedTags = {} }) => {
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
    const [tagOptions, setTagOptions] = useState({});
    const [loadingTags, setLoadingTags] = useState({});
    const [dropdownOpenState, setDropdownOpenState] = useState({});
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        fetchSyslogTags();
    }, []);

    const fetchSyslogTags = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/syslogs/tags/');
            const fetchedTags = response.data || [];
            setTags(fetchedTags);

            const initial = { ...selectedTags };
            fetchedTags.forEach(tag => {
                if (!initial[tag.name]) {
                    initial[tag.name] = [];
                }
            });

            setSelectedTags(initial);
            onSelectedSyslogFiltersChange(initial);
        } catch (error) {
            console.error('Error fetching Syslog Tags:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTagOptions = async (tagName, endpoint) => {
        setLoadingTags(prev => ({ ...prev, [tagName]: true }));
        try {
            const response = await apiClient.get(endpoint);
            const options = response.data.map((item) => ({
                value: item,
                label: item
            }));
            setTagOptions(prev => ({ ...prev, [tagName]: options }));
        } catch (error) {
            console.error(`Error fetching ${tagName} options:`, error);
        } finally {
            setLoadingTags(prev => ({ ...prev, [tagName]: false }));
        }
    };

    const handleFocus = (tagName) => {
        if (tagOptions[tagName]) return;

        if (tagName === 'mnemonic') {
            fetchTagOptions(tagName, '/signals/syslogs/mnemonics/options');
        } else if (tagName === 'rule') {
            fetchTagOptions(tagName, '/signals/syslogs/rules/options');
        } else if (tagName === 'device') {
            fetchTagOptions(tagName, '/signals/syslogs/devices/options');
        } else {
            fetchAffectedEntityOptions(tagName); // fallback for affected entities
        }
    };

    const fetchAffectedEntityOptions = async (tagName) => {
        setLoadingTags((prev) => ({ ...prev, [tagName]: true }));
        try {
            const response = await apiClient.get(`/signals/syslogs/affected-entities/options/${tagName}`);
            const valuesArray = response.data.values || [];

            setTagOptions((prevOptions) => ({
                ...prevOptions,
                [tagName]: valuesArray.map((value) => ({
                    value: value,
                    label: value,
                })),
            }));
        } catch (error) {
            console.error(`Error fetching values for entity ${tagName}:`, error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, [tagName]: false }));
        }
    };

    const handleChange = (selectedValues, tagName) => {
        const updatedSelectedTags = {
            ...selectedTags,
            [tagName]: selectedValues
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedSyslogFiltersChange(updatedSelectedTags);
    };

    const handleMenuOpen = (tagName) => {
        setDropdownOpenState(prev => ({ ...prev, [tagName]: true }));
    };

    const handleMenuClose = (tagName) => {
        setDropdownOpenState(prev => ({ ...prev, [tagName]: false }));
    };

    return (
        <div className="dropdownConfigContainer" style={{  color: 'var(--textColor)', padding: '10px', width: '400px' }}>
            {isLoading ? (
                <p style={{ textAlign: 'center' }}>Loading Syslog Tags...</p>
            ) : (
                <>
                    <span >Filter Syslog Signals:</span>
                    <div className="searchSyslogsFilterEntries" style={{ marginTop: '8px', padding: '10px' }}>
                        {['device', 'mnemonic', 'rule'].map((tagName) => (
                            <div className="searchSyslogsFilterEntry">
                                <span className="searchSignalFilterText">{tagName.charAt(0).toUpperCase() + tagName.slice(1)}:</span>
                                <div style={{ marginTop: '6px' }}>
                                <Select
                                    options={tagOptions[tagName] || []}
                                    isMulti
                                    value={selectedTags[tagName] || []}
                                    onChange={(selected) => handleChange(selected, tagName)}
                                    name={tagName}
                                    styles={customStyles('370px')}
                                    onFocus={() => handleFocus(tagName)}
                                    isLoading={loadingTags[tagName]}
                                    onMenuOpen={() => handleMenuOpen(tagName)}
                                    onMenuClose={() => handleMenuClose(tagName)}
                                />
                                </div>
                            </div>
                        ))}
                        {tags.map((tag) => (
                            <div className="searchSyslogsFilterEntry">
                                <span className="searchSignalFilterText">{tag.name}:</span>
                                <div style={{ marginTop: '6px' }}>
                                <Select
                                    options={tagOptions[tag.name] || []}
                                    isMulti
                                    value={selectedTags[tag.name]}
                                    onChange={(selectedValues) => handleChange(selectedValues, tag.name)}
                                    name={tag.name}
                                    onFocus={() => handleFocus(tag.name)}
                                    styles={customStyles('370px')}
                                    isLoading={loadingTags[tag.name]}
                                    onMenuOpen={() => handleMenuOpen(tag.name)}
                                    onMenuClose={() => handleMenuClose(tag.name)}
                                />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ justifyContent: 'center' }}>
                        <button style={{ padding: '8px 60px', color: 'green' }}>Search</button>
                    </div>
                </>
            )}
        </div>
    );
};

export default SyslogSignalFilters;
