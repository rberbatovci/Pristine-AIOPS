import React, { useState, useEffect } from 'react';
import apiClient from '../../misc/AxiosConfig';
import customStyles from '../../misc/SelectStyles';
import Select from 'react-select';
import './SignalConfigElement.css';

const SyslogMnemonicUpdater = ({ mnemonics }) => {
    const [selectedMnemonic, setSelectedMnemonic] = useState(null);
    const [description, setDescription] = useState('');
    const [createSignal, setCreateSignal] = useState(false);
    const [muteSignal, setMuteSignal] = useState(false);
    const [warmUp, setWarmUp] = useState('');
    const [coolDown, setCoolDown] = useState('');
    const [tags, setTags] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [syslogMnemonicName, setSyslogMnemonicName] = useState([]);

    const fetchTagNames = async () => {
        try {
            const response = await apiClient.get('/syslogs/tagnames/');
            const formattedTagNames = response.data.tagNames.map((tagName) => ({
                value: tagName,
                label: tagName,
            }));
            setTags(formattedTagNames);
        } catch (error) {
            console.error('Error fetching tag names:', error);
        }
    };

    const fetchMnemonicDetails = async (id) => {
        try {
            const response = await apiClient.get(`/syslogsignals/mnemonics/${id}/`);
            const { name, description, create_signal, warm_up, cool_down } = response.data;
            setSyslogMnemonicName(name);
            setDescription(description || '');
            setCreateSignal(create_signal || false);
            setWarmUp(warm_up !== null ? warm_up.toString() : '');
            setCoolDown(cool_down !== null ? cool_down.toString() : '');
        } catch (error) {
            console.error('Error fetching mnemonic details:', error);
        }
    };

    const handleMnemonicClick = (mnemonic) => {
        setSelectedMnemonic(mnemonic);
        fetchMnemonicDetails(mnemonic.id);
    };

    const handleSubmit = async () => {
        if (!selectedMnemonic) {
            console.log('Please select a mnemonic.');
            return;
        }

        try {
            await apiClient.patch(`/syslogsignals/mnemonic/${selectedMnemonic.id}/`, {
                description,
                create_signal: createSignal,
                warm_up: warmUp ? parseInt(warmUp, 10) : null,
                cool_down: coolDown ? parseInt(coolDown, 10) : null,
                tags: selectedTags.map(tag => tag.value), // Send selected tags as values
            });
            console.log('Mnemonic updated successfully!');
        } catch (error) {
            console.error('Error updating mnemonic:', error);
        }
    };

    return (
        <div className="signalConfigRuleContainer">
            {isLoading ? (
                <div className="signalConfigRuleMessage">Loading mnemonics. Please wait......</div>
            ) : error ? (
                <div className="signalConfigRuleMessage">{error}</div>
            ) : (
                <>
                    <div className="signalConfigRuleContent">
                        <div className="signalConfigRulesList" style={{height: '320px', width: '300px'}}>
                            <ul>
                                {mnemonics.map((mnemonic) => (
                                    <li
                                        key={mnemonic.id}
                                        className={`button ${selectedMnemonic && selectedMnemonic.id === mnemonic.id ? 'button-active' : ''}`}
                                        onClick={() => handleMnemonicClick(mnemonic)}
                                    >
                                        {mnemonic.name}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div style={{ width: '75%', margin: '10px' }}>
                            <div style={{ marginTop: '10px' }}>
                                <div style={{ marginBottom: '20px' }}>
                                    Syslog Mnemonic: <strong>{syslogMnemonicName}</strong>
                                </div>
                                <div style={{ display: 'flex', width: '340px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={createSignal}
                                            onChange={(e) => setCreateSignal(e.target.checked)}
                                            style={{ marginRight: '5px' }}
                                        />
                                        <span>Create Signal</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={muteSignal}
                                            onChange={(e) => setMuteSignal(e.target.checked)}
                                            style={{ marginRight: '5px' }}
                                        />
                                        <span>Mute Signal</span>
                                    </div>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <span>Affected Entities:</span>
                                    <Select
                                        name="affectedEntities"
                                        isMulti
                                        styles={customStyles}
                                        options={tags}
                                        onMenuOpen={fetchTagNames} // Load tags when Select is clicked
                                        value={selectedTags}
                                        onChange={(selectedOptions) => setSelectedTags(selectedOptions)}
                                    />
                                </div>
                                <div style={{ display: 'flex' }}>
                                    <div style={{ marginBottom: '10px', width: '40%' }}>
                                        <span>Warm Up (seconds):</span>
                                        <input
                                            type="number"
                                            value={warmUp}
                                            onChange={(e) => setWarmUp(e.target.value)}
                                            placeholder="Enter warm-up time..."
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                marginTop: '5px',
                                                borderRadius: '5px',
                                                border: '1px solid var(--borderColor)',
                                                background: 'var(--buttonBackground)',
                                            }}
                                        />
                                    </div>
                                    <div style={{ paddingLeft: '40px', marginBottom: '10px', width: '40%' }}>
                                        <span>Cool Down (seconds):</span>
                                        <input
                                            type="number"
                                            value={coolDown}
                                            onChange={(e) => setCoolDown(e.target.value)}
                                            placeholder="Enter cool-down time..."
                                            style={{
                                                width: '100%',
                                                padding: '10px',
                                                marginTop: '5px',
                                                borderRadius: '5px',
                                                border: '1px solid var(--borderColor)',
                                                background: 'var(--buttonBackground)',
                                            }}
                                        />
                                    </div>
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <span>Description:</span>
                                    <input
                                        type="text"
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="Enter description..."
                                        style={{
                                            width: '540px',
                                            padding: '10px',
                                            marginTop: '5px',
                                            borderRadius: '5px',
                                            border: '1px solid var(--borderColor)',
                                            background: 'var(--buttonBackground)',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
            {!isLoading && !error && (
                <div className="signalConfigButtonContainer">
                    <button
                        onClick={handleSubmit}
                        className="update-button"
                    >
                        Update Mnemonic
                    </button>
                </div>
            )}
        </div>
    );
};

export default SyslogMnemonicUpdater;
