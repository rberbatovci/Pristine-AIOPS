import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../../misc/AxiosConfig';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';

const TrapSignalFilters = ({ onSelectedSyslogFiltersChange, initialSelectedTags = {} }) => {
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
    const [tagOptions, setTagOptions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [loadingTags, setLoadingTags] = useState({
        snmpTrapOid: false,
        rule: false,
    });

    useEffect(() => {
        fetchSyslogTags();
    }, []);

    const fetchSyslogTags = async () => {
        setIsLoading(true);
        try {
            const response = await apiClient.get('/syslogs/tags/brief/');
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

    const fetchSnmpTrapOids = async () => {
        setLoadingTags((prev) => ({ ...prev, mnemonic: true }));
        try {
            const response = await apiClient.get('/traps/trapOids/');
            const mnemonicsArray = response.data || [];

            setTagOptions((prevOptions) => ({
                ...prevOptions,
                mnemonic: mnemonicsArray.map((mnemonic) => ({
                    value: mnemonic,
                    label: mnemonic,
                })),
            }));
        } catch (error) {
            console.error('Error fetching mnemonic options:', error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, mnemonic: false }));
        }
    };

    const fetchRuleOptions = async () => {
        setLoadingTags((prev) => ({ ...prev, rule: true }));
        try {
            const response = await apiClient.get('/syslogs/statefulsyslogrules/rules_list/');
            const rulesArray = response.data || [];

            setTagOptions((prevOptions) => ({
                ...prevOptions,
                rule: rulesArray.map((rule) => ({
                    value: rule,
                    label: rule,
                })),
            }));
        } catch (error) {
            console.error('Error fetching stateful syslog rules options:', error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, rule: false }));
        }
    };

    const fetchSignalOptions = async (tagName) => {
        if (tagOptions[tagName]) return;

        setLoadingTags((prev) => ({ ...prev, [tagName]: true }));
        try {
            const response = await apiClient.get(`/signals/api/affected_entities/${tagName}/`);
            const optionsArray = response.data[tagName] || [];
            if (optionsArray.length > 0) {
                setTagOptions((prevOptions) => ({
                    ...prevOptions,
                    [tagName]: optionsArray.map((option) => ({
                        value: option,
                        label: option,
                    })),
                }));
            }
        } catch (error) {
            console.error(`Error fetching options for tag Name ${tagName}:`, error);
        } finally {
            setLoadingTags((prev) => ({ ...prev, [tagName]: false }));
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
            fetchSnmpTrapOids();
        } else if (tagName === 'rule' && !tagOptions['rule']) {
            fetchRuleOptions();
        } else {
            fetchSignalOptions(tagName);
        }
    };

    return (
        <div className="dropdownConfigContainer" style={{  color: 'var(--textColor)', padding: '10px', width: '400px' }}>
            {isLoading ? (
                <p className="signalConfigRuleMessage">Loading mnemonics. Please wait......</p>
            ) : error ? (
                <p className="signalConfigRuleMessage">{error}</p>
            ) : (
                <>
                <span >Filter Syslog Signals:</span>
                <div className="searchSyslogsFilterEntries" style={{ marginTop: '8px', padding: '10px' }}>
                    <div className="searchSyslogsFilterEntry">
                        <span className="searchSignalFilterText">SNMP Trap OID:</span>
                        <div style={{ marginTop: '6px' }}>
                        <Select
                            options={tagOptions['snmpTrapOid'] || []}
                            isMulti
                            value={selectedTags['snmpTrapOid'] || []}
                            onChange={(selectedValues) => handleChange(selectedValues, 'snmpTrapOid')}
                            name="snmpTrapOid"
                            styles={customStyles('370px')}
                            onFocus={() => handleFocus('snmpTrapOid')}
                            isLoading={loadingTags.snmpTrapOid}
                        />
                        </div>
                    </div>
                    <div className="searchSyslogsFilterEntry">
                        <span className="searchSignalFilterText">Stateful Rule:</span>
                        <div style={{ marginTop: '6px' }}>
                        <Select
                            options={tagOptions['rule'] || []}
                            isMulti
                            value={selectedTags['rule'] || []} 
                            onChange={(selectedValues) => handleChange(selectedValues, 'rule')}
                            name="rule"
                            styles={customStyles('370px')}
                            onFocus={() => handleFocus('rule')}
                            isLoading={loadingTags.rule}
                        />
                        </div>
                    </div>
                    {tags.map((tag) => (
                        <div className="searchSyslogsFilterEntry">
                            <span className="searchSignalFilterText">{tag.name}:</span>
                            <div style={{ marginTop: '6px' }}>
                            <Select
                                options={tagOptions[tag.name] || []}
                                isMulti
                                value={selectedTags[tag.name]}
                                onChange={(selectedValues) => handleChange(selectedValues, tag.name)}
                                onFocus={() => handleFocus(tag.name)}
                                name={tag.name}
                                styles={customStyles('370px')}
                                isLoading={loadingTags[tag.name]}
                            />
                            </div>
                        </div>
                    ))}
                </div>
                </>
            )}
        </div>
    );
};

export default TrapSignalFilters;
