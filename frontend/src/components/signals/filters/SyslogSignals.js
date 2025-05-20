import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../../misc/AxiosConfig';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';

const SyslogSignalFilters = ({ onSelectedSyslogFiltersChange, initialSelectedTags = {} }) => {
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
    const [tagOptions, setTagOptions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [loadingTags, setLoadingTags] = useState({
        mnemonic: false,
        rule: false,
    });
    const [dropdownOpenState, setDropdownOpenState] = useState({});

    useEffect(() => {
        fetchSyslogTags();
    }, []);

    const fetchSyslogTags = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/syslogs/tags/');
            const fetchedTags = response.data || [];
            setTags(fetchedTags);

            const initialTags = { ...selectedTags };
            fetchedTags.forEach((tag) => {
                if (!initialTags[tag.name]) {
                    initialTags[tag.name] = [];
                }
            });

            setSelectedTags(initialTags);
            onSelectedSyslogFiltersChange(initialTags);
        } catch (error) {
            console.error('Error fetching Syslog Tags:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchMnemonicOptions = async () => {
        setLoadingTags((prev) => ({ ...prev, mnemonic: true }));
        try {
            const response = await apiClient.get('/signals/syslogSignals/used-mnemonics/');
            const mnemonicsArray = response.data || [];

            setTagOptions((prevOptions) => ({
                ...prevOptions,
                mnemonic: mnemonicsArray.map((mnemonic) => ({
                    value: mnemonic.id,
                    label: mnemonic.name,
                })),
            }));
        } catch (error) {
            console.error('Error fetching mnemonic options:', error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, mnemonic: false }));
        }
    };

    const fetchDevices = async () => {
        setLoadingTags((prev) => ({ ...prev, device: true }));
        try {
            const response = await apiClient.get('/signals/syslogSignals/used-devices/');
            const devicesArray = response.data || [];

            setTagOptions((prevOptions) => ({
                ...prevOptions,
                device: devicesArray.map((device) => ({
                    value: device.id,
                    label: device.name,
                })),
            }));
        } catch (error) {
            console.error('Error fetching devices options:', error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, device: false }));
        }
    };

    const fetchRuleOptions = async () => {
        setLoadingTags((prev) => ({ ...prev, rule: true }));
        try {
            const response = await apiClient.get('/signals/syslogSignals/used-rules/');
            const rulesArray = response.data || [];

            setTagOptions((prevOptions) => ({
                ...prevOptions,
                rule: rulesArray.map((rule) => ({
                    value: rule.id,
                    label: rule.name,
                })),
            }));
        } catch (error) {
            console.error('Error fetching stateful syslog rules options:', error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, rule: false }));
        }
    };

    const handleChange = (selectedValues, tagName) => {
        const updatedSelectedTags = {
            ...selectedTags,
            [tagName]: selectedValues,
        };
        setSelectedTags(updatedSelectedTags);
        onSelectedSyslogFiltersChange(updatedSelectedTags);
    };

    const handleFocus = (tagName) => {
        if (tagName === 'mnemonic' && !tagOptions['mnemonic']) {
            fetchMnemonicOptions();
        } else if (tagName === 'rule' && !tagOptions['rule']) {
            fetchRuleOptions();
        } else if (tagName === 'device' && !tagOptions['device']) {
            fetchDevices();
        }
    };

    const handleMenuOpen = (tagName) => {
        setDropdownOpenState((prev) => ({ ...prev, [tagName]: true }));
    };

    const handleMenuClose = (tagName) => {
        setDropdownOpenState((prev) => ({ ...prev, [tagName]: false }));
    };

    return (
        <div className="dropdownConfigContainer" style={{ padding: '10px' }}>
            {isLoading ? (
                <div>
                    <p style={{ textAlign: 'center' }}>Loading Syslog Tags...</p>
                </div>
            ) : (
                <div>
                    <span style={{ color: 'var(--textColor2)' }}>Filter Syslog Signals:</span>
                    <div className="search-signals-container" style={{ marginTop: '8px' }}>
                        <div className="search-signals-item">
                            <p>Device:</p>
                            <Select
                                options={tagOptions['device'] || []}
                                isMulti
                                value={selectedTags['device'] || []}
                                onChange={(selectedValues) => handleChange(selectedValues, 'device')}
                                name="device"
                                styles={customStyles('300px')}
                                onFocus={() => handleFocus('device')}
                                isLoading={loadingTags.mnemonic}
                                onMenuOpen={() => handleMenuOpen('device')}
                                onMenuClose={() => handleMenuClose('device')}
                            />
                        </div>
                        <div className="search-signals-item">
                            <p>Mnemonic:</p>
                            <Select
                                options={tagOptions['mnemonic'] || []}
                                isMulti
                                value={selectedTags['mnemonic'] || []}
                                onChange={(selectedValues) => handleChange(selectedValues, 'mnemonic')}
                                name="mnemonic"
                                styles={customStyles('300px')}
                                onFocus={() => handleFocus('mnemonic')}
                                isLoading={loadingTags.mnemonic}
                                onMenuOpen={() => handleMenuOpen('mnemonic')}
                                onMenuClose={() => handleMenuClose('mnemonic')}
                            />
                        </div>
                        <div className="search-signals-item">
                            <p>Stateful Rule:</p>
                            <Select
                                options={tagOptions['rule'] || []}
                                isMulti
                                value={selectedTags['rule'] || []}
                                onChange={(selectedValues) => handleChange(selectedValues, 'rule')}
                                name="rule"
                                styles={customStyles('300px')}
                                onFocus={() => handleFocus('rule')}
                                isLoading={loadingTags.rule}
                                onMenuOpen={() => handleMenuOpen('rule')}
                                onMenuClose={() => handleMenuClose('rule')}
                            />
                        </div>
                        {tags.map((tag) => (
                            <div key={tag.name} className="search-signals-item">
                                <p>{tag.name}:</p>
                                <Select
                                    options={tagOptions[tag.name] || []}
                                    isMulti
                                    value={selectedTags[tag.name]}
                                    onChange={(selectedValues) => handleChange(selectedValues, tag.name)}
                                    name={tag.name}
                                    styles={customStyles('300px')}
                                    isLoading={loadingTags[tag.name]}
                                    onMenuOpen={() => handleMenuOpen(tag.name)}
                                    onMenuClose={() => handleMenuClose(tag.name)}
                                />
                            </div>
                        ))}
                    </div>
                    <div style={{ justifyContent: 'center' }}>
                        <button style={{ padding: '8px 60px' }}>Search</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SyslogSignalFilters;
