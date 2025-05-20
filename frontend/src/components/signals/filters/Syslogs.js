import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import apiClient from '../../misc/AxiosConfig';
import '../../../css/SearchElement.css';
import customStyles from '../../misc/SelectStyles';

const Syslogs = ({ onSelectedSyslogFiltersChange, initialSelectedTags = {} }) => {
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState(initialSelectedTags);
    const [tagOptions, setTagOptions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [loadingTags, setLoadingTags] = useState({
        mnemonic: false,
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

    const fetchMnemonicOptions = async () => {
        setLoadingTags((prev) => ({ ...prev, mnemonic: true }));
        try {
            const response = await apiClient.get('/syslogs/mnemonics/mnemonicList/');
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
            fetchMnemonicOptions();
        } else if (tagName === 'rule' && !tagOptions['rule']) {
            fetchRuleOptions();
        } else {
            fetchSignalOptions(tagName);
        }
    };

    return (
        <div style={{ width: '100%', display: 'flex' }}>
            {isLoading ? (
                <div>
                    <p style={{ textAlign: 'center' }}>Loading Syslog Tags...</p>
                </div>
            ) : (
                <div className="search-signals-container">
                    <div className="search-signals-item">
                        <p>Mnemonic:</p>
                        <Select
                            options={tagOptions['mnemonic'] || []}
                            isMulti
                            value={selectedTags['mnemonic'] || []}
                            onChange={(selectedValues) => handleChange(selectedValues, 'mnemonic')}
                            name="mnemonic"
                            styles={customStyles}
                            onFocus={() => handleFocus('mnemonic')}
                            isLoading={loadingTags.mnemonic}
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
                            styles={customStyles}
                            onFocus={() => handleFocus('rule')}
                            isLoading={loadingTags.rule}
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
                                onFocus={() => handleFocus(tag.name)}
                                name={tag.name}
                                styles={customStyles}
                                isLoading={loadingTags[tag.name]}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Syslogs;
